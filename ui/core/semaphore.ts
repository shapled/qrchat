type ResolveFunc = () => void;

export class Semaphore {
  capacity: number;
  available: number;
  waitingQueue: ResolveFunc[];

  constructor(capacity = 1) {
    this.capacity = capacity;
    this.available = capacity;
    this.waitingQueue = [];
  }

  acquire() {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve();
    } else {
      return new Promise((resolve) => {
        this.waitingQueue.push(() => resolve(null));
      });
    }
  }

  release() {
    if (this.waitingQueue.length > 0) {
      const nextInLine = this.waitingQueue.shift();
      nextInLine!();
    } else {
      this.available++;
    }
  }
}
