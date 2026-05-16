import { PasswordHasherService } from './password-hasher.service';

describe('PasswordHasherService', () => {
  let service: PasswordHasherService;

  beforeEach(() => {
    service = new PasswordHasherService();
  });

  it('hashes passwords without storing the plain text', async () => {
    const hash = await service.hash('CorrectHorseBatteryStaple1!');

    expect(hash).not.toContain('CorrectHorseBatteryStaple1!');
    expect(hash).toMatch(/^scrypt\$/);
    await expect(
      service.verify('CorrectHorseBatteryStaple1!', hash),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password for an existing hash', async () => {
    const hash = await service.hash('CorrectHorseBatteryStaple1!');

    await expect(service.verify('wrong-password', hash)).resolves.toBe(false);
  });
});
