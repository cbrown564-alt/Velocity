# ReadStat WASM Build Makefile
# Compiles libreadstat to WebAssembly using Emscripten

READSTAT_DIR = lib/ReadStat
SRC_DIR = src
DIST_DIR = dist

# Emscripten compiler
EMCC = emcc

# Compiler flags
# Compiler flags
CFLAGS = -O3 -flto
WASM_FLAGS = \
	-s WASM=1 \
	-s MODULARIZE=1 \
	-s EXPORT_ES6=1 \
	-s EXPORT_NAME=ReadStatModule \
	-s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue","UTF8ToString","stringToUTF8","writeArrayToMemory","HEAPU8"]' \
	-s INITIAL_MEMORY=536870912 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MAXIMUM_MEMORY=2GB \
	-s NO_EXIT_RUNTIME=1 \
	-s STACK_SIZE=5242880 \
	-s USE_ZLIB=1 \
	-s FILESYSTEM=0 \
	-s ENVIRONMENT=web,worker \
	-s ALLOW_TABLE_GROWTH=1 \
	--no-entry

# ReadStat source files needed for SAV parsing
READSTAT_SOURCES = \
	$(READSTAT_DIR)/src/CKHashTable.c \
	$(READSTAT_DIR)/src/readstat_bits.c \
	$(READSTAT_DIR)/src/readstat_convert.c \
	$(READSTAT_DIR)/src/readstat_error.c \
	$(READSTAT_DIR)/src/readstat_io_unistd.c \
	$(READSTAT_DIR)/src/readstat_malloc.c \
	$(READSTAT_DIR)/src/readstat_metadata.c \
	$(READSTAT_DIR)/src/readstat_parser.c \
	$(READSTAT_DIR)/src/readstat_value.c \
	$(READSTAT_DIR)/src/readstat_variable.c \
	$(READSTAT_DIR)/src/spss/readstat_sav.c \
	$(READSTAT_DIR)/src/spss/readstat_sav_compress.c \
	$(READSTAT_DIR)/src/spss/readstat_sav_parse.c \
	$(READSTAT_DIR)/src/spss/readstat_sav_parse_mr_name.c \
	$(READSTAT_DIR)/src/spss/readstat_sav_parse_timestamp.c \
	$(READSTAT_DIR)/src/spss/readstat_sav_read.c \
	$(READSTAT_DIR)/src/spss/readstat_spss.c \
	$(READSTAT_DIR)/src/spss/readstat_spss_parse.c \
	$(READSTAT_DIR)/src/spss/readstat_zsav_compress.c \
	$(READSTAT_DIR)/src/spss/readstat_zsav_read.c

# Include paths
INCLUDES = -I$(READSTAT_DIR)/src

.PHONY: all clean dist setup check-emcc

all: check-emcc $(DIST_DIR)/readstat.js

check-emcc:
	@which emcc > /dev/null || (echo "Error: Emscripten not found. Install via 'brew install emscripten'" && exit 1)

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

# Main build target
# Exported functions include:
# - Core parsing: parse_sav, parse_sav_metadata, parse_sav_sample
# - Metadata accessors: get_variable_count, get_row_count, etc.
# - Value accessors: is_cell_missing, get_numeric_value, get_string_value
# - Streaming API: get_total_row_count, release_rows_up_to, etc.
$(DIST_DIR)/readstat.js: $(SRC_DIR)/readstat_wasm.c $(READSTAT_SOURCES) | $(DIST_DIR)
	$(EMCC) $(CFLAGS) $(WASM_FLAGS) $(INCLUDES) \
		-s EXPORTED_FUNCTIONS='["_malloc","_free","_parse_sav","_parse_sav_metadata","_parse_sav_sample","_get_variable_count","_get_row_count","_get_parsed_row_count","_get_sample_strategy","_get_value_label_count","_get_variable_name","_get_variable_type","_get_variable_label","_get_variable_value_labels_name","_get_value_label_set_name","_get_value_label_value","_get_value_label_label","_is_cell_missing","_get_numeric_value","_get_string_value","_free_parse_results","_get_error_message","_get_mr_set_count","_get_mr_set_name","_get_mr_set_label","_get_mr_set_type","_get_mr_set_counted_value","_get_mr_set_subvar_count","_get_mr_set_subvar","_get_total_row_count","_get_available_row_count","_get_released_row_count","_release_rows_up_to","_get_row_batch_numeric","_get_row_batch_missing"]' \
		-o $@ \
		$(SRC_DIR)/readstat_wasm.c \
		$(READSTAT_SOURCES)
	@echo "✅ Built readstat.js and readstat.wasm"

clean:
	rm -rf $(DIST_DIR)

# Development: quick syntax check
syntax-check:
	$(EMCC) -fsyntax-only $(INCLUDES) $(SRC_DIR)/readstat_wasm.c
