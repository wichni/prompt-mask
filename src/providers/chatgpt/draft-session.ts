import type { DraftSessionId } from "../../platform/chromium/messages";

type SessionIdFactory = () => DraftSessionId;

export class DraftSession {
  #sessionId: DraftSessionId;
  #contextGeneration = 0;
  #changeGeneration = 0;

  constructor(private readonly createSessionId: SessionIdFactory) {
    this.#sessionId = createSessionId();
  }

  get sessionId(): DraftSessionId {
    return this.#sessionId;
  }

  get contextGeneration(): number {
    return this.#contextGeneration;
  }

  get changeGeneration(): number {
    return this.#changeGeneration;
  }

  markDraftChanged(): void {
    this.#changeGeneration += 1;
  }

  startNewContext(): void {
    this.#sessionId = this.createSessionId();
    this.#contextGeneration += 1;
    this.#changeGeneration += 1;
  }
}
