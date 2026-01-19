
import { Collaborator, TableConfig, Variable } from '../types';

type Listener = (users: Collaborator[]) => void;
type ConfigListener = (config: TableConfig, user: string) => void;

const MOCK_USERS = [
  { id: 'u1', name: 'Alice Chen', color: '#EF4444' }, // Red
  { id: 'u2', name: 'Marcus J.', color: '#10B981' }, // Emerald
  { id: 'u3', name: 'Sarah W.', color: '#F59E0B' }, // Amber
];

export class SimulationService {
  private static instance: SimulationService;
  private users: Collaborator[] = [];
  private listeners: Listener[] = [];
  private configListeners: ConfigListener[] = [];
  private interval: any;

  private constructor() { }

  public static getInstance(): SimulationService {
    if (!SimulationService.instance) {
      SimulationService.instance = new SimulationService();
    }
    return SimulationService.instance;
  }

  public connect(variables: Variable[]) {
    // Spawn users
    this.users = MOCK_USERS.map(u => ({
      ...u,
      x: 50 + (Math.random() * 20 - 10),
      y: 50 + (Math.random() * 20 - 10),
    }));

    // Start Loop
    this.interval = setInterval(() => {
      this.updatePositions();
      this.maybePerformAction(variables);
    }, 2000); // Update every 2s to be less chaotic
  }

  public disconnect() {
    clearInterval(this.interval);
    this.users = [];
    this.notify();
  }

  public subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => this.listeners = this.listeners.filter(l => l !== fn);
  }

  public onRemoteConfigUpdate(fn: ConfigListener) {
    this.configListeners.push(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn([...this.users]));
  }

  private updatePositions() {
    this.users = this.users.map(u => ({
      ...u,
      x: Math.max(10, Math.min(90, u.x + (Math.random() * 40 - 20))),
      y: Math.max(10, Math.min(90, u.y + (Math.random() * 40 - 20))),
      activeAction: undefined // clear old actions
    }));
    this.notify();
  }

  private maybePerformAction(variables: Variable[]) {
    if (Math.random() > 0.7) return; // 30% chance of action

    // Pick a random user to do something
    const actorIndex = Math.floor(Math.random() * this.users.length);
    const actor = this.users[actorIndex];

    // Pick random variables
    const rowVar = variables[Math.floor(Math.random() * variables.length)];
    const colVar = Math.random() > 0.5 ? variables[Math.floor(Math.random() * variables.length)] : null;

    if (!rowVar) return;

    // Update user state to show they are doing it
    this.users[actorIndex].activeAction = `Updating view...`;
    this.notify();

    // Trigger config update
    setTimeout(() => {
      const newConfig: TableConfig = {
        rowVars: [rowVar.id],
        colVar: colVar?.id || null
      };
      this.configListeners.forEach(fn => fn(newConfig, actor.name));
    }, 1000);
  }
}

export const simService = SimulationService.getInstance();
