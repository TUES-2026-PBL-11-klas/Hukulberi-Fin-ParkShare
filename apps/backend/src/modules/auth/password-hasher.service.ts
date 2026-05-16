import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(
      password,
      salt,
      KEY_LENGTH,
    )) as Buffer;

    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, salt, hash] = storedHash.split('$');

    if (algorithm !== 'scrypt' || !salt || !hash) {
      return false;
    }

    const derivedKey = (await scryptAsync(
      password,
      salt,
      KEY_LENGTH,
    )) as Buffer;
    const storedKey = Buffer.from(hash, 'hex');

    if (storedKey.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(storedKey, derivedKey);
  }
}
