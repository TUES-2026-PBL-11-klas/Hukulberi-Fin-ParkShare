import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { PublicUserDto } from '@parkshare/contracts';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  async signForUser(user: PublicUserDto): Promise<string> {
    const expiresIn = (process.env.JWT_EXPIRES_IN ??
      '1h') as JwtSignOptions['expiresIn'];

    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      } satisfies AccessTokenPayload,
      {
        secret: this.getJwtSecret(),
        expiresIn,
      } satisfies JwtSignOptions,
    );
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (secret) {
      return secret;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }

    return 'parkshare-local-development-secret-change-me';
  }
}
