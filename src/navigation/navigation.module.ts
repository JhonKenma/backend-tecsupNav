// src/navigation/navigation.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NavigationService } from './navigation.service';
import { NavigationController } from './navigation.controller';
import { NavigationGateway } from './navigation.gateway';
import { PlacesModule } from '../places/places.module';
import { CustomRoutesModule } from '../custom-routes/custom-routes.module';

@Module({
  imports: [
    PlacesModule, 
    CustomRoutesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [NavigationController],
  providers: [NavigationService, NavigationGateway],
  exports: [NavigationService, NavigationGateway],
})
export class NavigationModule {}