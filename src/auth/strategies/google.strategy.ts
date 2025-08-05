// src/auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const options: StrategyOptions = {
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: `${configService.get<string>('BASE_URL', 'http://localhost:3000')}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    };
    
    super(options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, name } = profile;
    
    // Verificar que el email sea institucional
    const email = emails[0].value;
    if (!email.endsWith('@tecsup.edu.pe')) {
      return done(new Error('Solo se permiten correos institucionales'), false);
    }

    const user = await this.authService.findOrCreateGoogleUser({
      googleId: id,
      email,
      firstName: name.givenName,
      lastName: name.familyName,
    });

    done(null, user);
  }
}