import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private cfg() {
    return this.config.get('jwt') as {
      accessSecret: string;
      refreshSecret: string;
      accessTtl: number;
      refreshTtl: number;
    };
  }

  signAccess(payload: JwtPayload): string {
    const j = this.cfg();
    return this.jwt.sign(payload, { secret: j.accessSecret, expiresIn: j.accessTtl });
  }

  signRefresh(payload: JwtPayload): string {
    const j = this.cfg();
    return this.jwt.sign(payload, { secret: j.refreshSecret, expiresIn: j.refreshTtl });
  }

  verifyAccess(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, { secret: this.cfg().accessSecret });
  }

  verifyRefresh(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, { secret: this.cfg().refreshSecret });
  }
}
