import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MockAccessProvider {
  private readonly logger = new Logger(MockAccessProvider.name);

  async unlockGate(gateId: string): Promise<boolean> {
    this.logger.log(`Attempting to unlock gate: ${gateId}`);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate a successful gate unlock
    this.logger.log(`Gate ${gateId} unlocked successfully`);
    return true;
  }
}
