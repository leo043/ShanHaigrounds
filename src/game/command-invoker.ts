import type { GameState } from './types'
import type { Command } from './commands'
import { EventBus } from './event-bus'

export class CommandInvoker {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private recording: Command[] | null = null

  constructor(private bus: EventBus) {}

  execute(cmd: Command, state: GameState): void {
    cmd.execute(state)
    if (!cmd.succeeded()) return
    this.undoStack.push(cmd)
    this.redoStack = []
    this.bus.emit(cmd.type, cmd.describe())
    this.recording?.push(cmd)
  }

  undo(state: GameState): boolean {
    const cmd = this.undoStack.pop()
    if (!cmd) return false
    cmd.undo(state)
    this.redoStack.push(cmd)
    this.bus.emit('undo', cmd.describe())
    return true
  }

  redo(state: GameState): boolean {
    const cmd = this.redoStack.pop()
    if (!cmd) return false
    cmd.execute(state)
    this.undoStack.push(cmd)
    this.bus.emit('redo', cmd.describe())
    return true
  }

  startRecording(): void {
    this.recording = []
  }

  stopRecording(): Command[] {
    const cmds = this.recording ?? []
    this.recording = null
    return cmds
  }

  async replay(
    commands: Command[],
    state: GameState,
    onStep?: (cmd: Command, i: number) => Promise<void> | void,
  ): Promise<void> {
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]
      cmd.execute(state)
      this.bus.emit(cmd.type, cmd.describe())
      if (onStep) await onStep(cmd, i)
    }
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.recording = null
  }
}
