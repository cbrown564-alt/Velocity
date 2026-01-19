/**
 * ReadStat WASM Shim (Simplified Version)
 *
 * Bridges libreadstat to JavaScript via Emscripten.
 * Uses a buffer-based approach instead of callbacks for safety.
 */

#include "readstat.h"
#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ============================================================================
// Global State for Accumulating Parse Results
// ============================================================================

#define MAX_VARIABLES 10000
#define MAX_VALUE_LABELS 100000
#define MAX_LABEL_LENGTH 256
#define MAX_NAME_LENGTH 128

typedef struct {
  char name[MAX_NAME_LENGTH];
  int type; // 0 = numeric, 1 = string
  char label[MAX_LABEL_LENGTH];
  char value_labels_name[MAX_NAME_LENGTH];
} variable_info_t;

typedef struct {
  char set_name[MAX_NAME_LENGTH];
  double value;
  char label[MAX_LABEL_LENGTH];
} value_label_t;

// Parse state
static variable_info_t *g_variables = NULL;
static int g_variable_count = 0;
static value_label_t *g_value_labels = NULL;
static int g_value_label_count = 0;
static int g_row_count = 0;
static int g_expected_row_count = 0;

// Data storage - dynamic array of values
static double *g_numeric_data = NULL;
static char **g_string_data = NULL;
static int *g_is_missing = NULL;
static size_t g_data_capacity = 0;
static size_t g_data_size = 0;

// ============================================================================
// Memory Buffer I/O Context
// ============================================================================

typedef struct {
  const uint8_t *buffer;
  size_t size;
  size_t position;
} mem_io_ctx_t;

static int mem_open(const char *path, void *io_ctx) {
  (void)path;
  mem_io_ctx_t *ctx = (mem_io_ctx_t *)io_ctx;
  ctx->position = 0;
  return 0;
}

static int mem_close(void *io_ctx) {
  (void)io_ctx;
  return 0;
}

static readstat_off_t mem_seek(readstat_off_t offset,
                               readstat_io_flags_t whence, void *io_ctx) {
  mem_io_ctx_t *ctx = (mem_io_ctx_t *)io_ctx;

  switch (whence) {
  case READSTAT_SEEK_SET:
    ctx->position = offset;
    break;
  case READSTAT_SEEK_CUR:
    ctx->position += offset;
    break;
  case READSTAT_SEEK_END:
    ctx->position = ctx->size + offset;
    break;
  }

  if (ctx->position > ctx->size) {
    ctx->position = ctx->size;
  }

  return ctx->position;
}

static ssize_t mem_read(void *buf, size_t nbyte, void *io_ctx) {
  mem_io_ctx_t *ctx = (mem_io_ctx_t *)io_ctx;

  size_t remaining = ctx->size - ctx->position;
  size_t to_read = (nbyte < remaining) ? nbyte : remaining;

  if (to_read > 0) {
    memcpy(buf, ctx->buffer + ctx->position, to_read);
    ctx->position += to_read;
  }

  return (ssize_t)to_read;
}

static readstat_error_t mem_update(long file_size,
                                   readstat_progress_handler progress_handler,
                                   void *user_ctx, void *io_ctx) {
  (void)file_size;
  (void)progress_handler;
  (void)user_ctx;
  (void)io_ctx;
  return READSTAT_OK;
}

// ============================================================================
// ReadStat Callback Handlers
// ============================================================================

static int handle_metadata(readstat_metadata_t *metadata, void *ctx) {
  (void)ctx;
  g_expected_row_count = readstat_get_row_count(metadata);
  g_variable_count = readstat_get_var_count(metadata);

  // Allocate variables array
  g_variables =
      (variable_info_t *)calloc(g_variable_count, sizeof(variable_info_t));

  return READSTAT_HANDLER_OK;
}

static int handle_variable(int index, readstat_variable_t *variable,
                           const char *val_labels, void *ctx) {
  (void)ctx;

  if (index >= g_variable_count)
    return READSTAT_HANDLER_OK;

  const char *name = readstat_variable_get_name(variable);
  const char *label = readstat_variable_get_label(variable);
  readstat_type_class_t type_class = readstat_variable_get_type_class(variable);

  if (name)
    strncpy(g_variables[index].name, name, MAX_NAME_LENGTH - 1);
  if (label)
    strncpy(g_variables[index].label, label, MAX_LABEL_LENGTH - 1);
  if (val_labels)
    strncpy(g_variables[index].value_labels_name, val_labels,
            MAX_NAME_LENGTH - 1);
  g_variables[index].type = (type_class == READSTAT_TYPE_CLASS_STRING) ? 1 : 0;

  return READSTAT_HANDLER_OK;
}

static int handle_value_label(const char *val_labels, readstat_value_t value,
                              const char *label, void *ctx) {
  (void)ctx;

  if (g_value_label_count >= MAX_VALUE_LABELS)
    return READSTAT_HANDLER_OK;

  if (!g_value_labels) {
    g_value_labels =
        (value_label_t *)calloc(MAX_VALUE_LABELS, sizeof(value_label_t));
  }

  if (val_labels)
    strncpy(g_value_labels[g_value_label_count].set_name, val_labels,
            MAX_NAME_LENGTH - 1);
  if (label)
    strncpy(g_value_labels[g_value_label_count].label, label,
            MAX_LABEL_LENGTH - 1);

  if (readstat_value_type_class(value) == READSTAT_TYPE_CLASS_NUMERIC) {
    g_value_labels[g_value_label_count].value = readstat_double_value(value);
  }

  g_value_label_count++;
  return READSTAT_HANDLER_OK;
}

static int handle_value(int obs_index, readstat_variable_t *variable,
                        readstat_value_t value, void *ctx) {
  (void)ctx;

  int var_index = readstat_variable_get_index(variable);
  size_t cell_index = (size_t)obs_index * g_variable_count + var_index;

  // Ensure capacity
  if (cell_index >= g_data_capacity) {
    size_t new_capacity = (cell_index + 1) * 2;
    g_numeric_data =
        (double *)realloc(g_numeric_data, new_capacity * sizeof(double));
    g_string_data =
        (char **)realloc(g_string_data, new_capacity * sizeof(char *));
    g_is_missing = (int *)realloc(g_is_missing, new_capacity * sizeof(int));

    // Initialize new memory
    for (size_t i = g_data_capacity; i < new_capacity; i++) {
      g_numeric_data[i] = 0;
      g_string_data[i] = NULL;
      g_is_missing[i] = 1;
    }
    g_data_capacity = new_capacity;
  }

  if (cell_index >= g_data_size) {
    g_data_size = cell_index + 1;
  }

  int is_missing = readstat_value_is_missing(value, variable);
  g_is_missing[cell_index] = is_missing;

  if (!is_missing) {
    readstat_type_class_t type_class = readstat_value_type_class(value);
    if (type_class == READSTAT_TYPE_CLASS_NUMERIC) {
      readstat_type_t type = readstat_value_type(value);
      switch (type) {
      case READSTAT_TYPE_INT8:
        g_numeric_data[cell_index] = readstat_int8_value(value);
        break;
      case READSTAT_TYPE_INT16:
        g_numeric_data[cell_index] = readstat_int16_value(value);
        break;
      case READSTAT_TYPE_INT32:
        g_numeric_data[cell_index] = readstat_int32_value(value);
        break;
      case READSTAT_TYPE_FLOAT:
        g_numeric_data[cell_index] = readstat_float_value(value);
        break;
      case READSTAT_TYPE_DOUBLE:
        g_numeric_data[cell_index] = readstat_double_value(value);
        break;
      default:
        break;
      }
    } else {
      const char *str = readstat_string_value(value);
      if (str) {
        g_string_data[cell_index] = strdup(str);
      }
    }
  }

  if (var_index == g_variable_count - 1) {
    g_row_count = obs_index + 1;
  }

  return READSTAT_HANDLER_OK;
}

// ============================================================================
// Cleanup Function
// ============================================================================

static void cleanup_parse_state(void) {
  if (g_variables) {
    free(g_variables);
    g_variables = NULL;
  }
  if (g_value_labels) {
    free(g_value_labels);
    g_value_labels = NULL;
  }
  if (g_numeric_data) {
    free(g_numeric_data);
    g_numeric_data = NULL;
  }
  if (g_string_data) {
    for (size_t i = 0; i < g_data_capacity; i++) {
      if (g_string_data[i])
        free(g_string_data[i]);
    }
    free(g_string_data);
    g_string_data = NULL;
  }
  if (g_is_missing) {
    free(g_is_missing);
    g_is_missing = NULL;
  }
  g_variable_count = 0;
  g_value_label_count = 0;
  g_row_count = 0;
  g_expected_row_count = 0;
  g_data_capacity = 0;
  g_data_size = 0;
}

// ============================================================================
// Public API
// ============================================================================

EMSCRIPTEN_KEEPALIVE
int parse_sav(uint8_t *buffer, size_t len) {
  cleanup_parse_state();

  mem_io_ctx_t mem_ctx = {.buffer = buffer, .size = len, .position = 0};

  readstat_parser_t *parser = readstat_parser_init();
  if (!parser) {
    return READSTAT_ERROR_MALLOC;
  }

  readstat_set_open_handler(parser, mem_open);
  readstat_set_close_handler(parser, mem_close);
  readstat_set_seek_handler(parser, mem_seek);
  readstat_set_read_handler(parser, mem_read);
  readstat_set_update_handler(parser, mem_update);
  readstat_set_io_ctx(parser, &mem_ctx);

  readstat_set_metadata_handler(parser, handle_metadata);
  readstat_set_variable_handler(parser, handle_variable);
  readstat_set_value_label_handler(parser, handle_value_label);
  readstat_set_value_handler(parser, handle_value);

  readstat_error_t error = readstat_parse_sav(parser, "", NULL);
  readstat_parser_free(parser);

  return (int)error;
}

EMSCRIPTEN_KEEPALIVE
int get_variable_count(void) { return g_variable_count; }

EMSCRIPTEN_KEEPALIVE
int get_row_count(void) { return g_row_count; }

EMSCRIPTEN_KEEPALIVE
int get_value_label_count(void) { return g_value_label_count; }

EMSCRIPTEN_KEEPALIVE
const char *get_variable_name(int index) {
  if (index < 0 || index >= g_variable_count)
    return "";
  return g_variables[index].name;
}

EMSCRIPTEN_KEEPALIVE
int get_variable_type(int index) {
  if (index < 0 || index >= g_variable_count)
    return 0;
  return g_variables[index].type;
}

EMSCRIPTEN_KEEPALIVE
const char *get_variable_label(int index) {
  if (index < 0 || index >= g_variable_count)
    return "";
  return g_variables[index].label;
}

EMSCRIPTEN_KEEPALIVE
const char *get_variable_value_labels_name(int index) {
  if (index < 0 || index >= g_variable_count)
    return "";
  return g_variables[index].value_labels_name;
}

EMSCRIPTEN_KEEPALIVE
const char *get_value_label_set_name(int index) {
  if (index < 0 || index >= g_value_label_count)
    return "";
  return g_value_labels[index].set_name;
}

EMSCRIPTEN_KEEPALIVE
double get_value_label_value(int index) {
  if (index < 0 || index >= g_value_label_count)
    return 0;
  return g_value_labels[index].value;
}

EMSCRIPTEN_KEEPALIVE
const char *get_value_label_label(int index) {
  if (index < 0 || index >= g_value_label_count)
    return "";
  return g_value_labels[index].label;
}

EMSCRIPTEN_KEEPALIVE
int is_cell_missing(int row, int col) {
  size_t index = (size_t)row * g_variable_count + col;
  if (index >= g_data_size)
    return 1;
  return g_is_missing[index];
}

EMSCRIPTEN_KEEPALIVE
double get_numeric_value(int row, int col) {
  size_t index = (size_t)row * g_variable_count + col;
  if (index >= g_data_size)
    return 0;
  return g_numeric_data[index];
}

EMSCRIPTEN_KEEPALIVE
const char *get_string_value(int row, int col) {
  size_t index = (size_t)row * g_variable_count + col;
  if (index >= g_data_size || !g_string_data[index])
    return "";
  return g_string_data[index];
}

EMSCRIPTEN_KEEPALIVE
void free_parse_results(void) { cleanup_parse_state(); }

EMSCRIPTEN_KEEPALIVE
const char *get_error_message(int error_code) {
  return readstat_error_message((readstat_error_t)error_code);
}
