import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateSettingsDto } from './dto/users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('userId') userId: string) {
    return this.users.getPrivateProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/settings')
  updateSettings(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.users.updateSettings(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/age-verification')
  verifyAge(@CurrentUser('userId') userId: string) {
    return this.users.verifyAge(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/streak')
  streak(@CurrentUser('userId') userId: string) {
    return this.users.processLogin(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  deleteAccount(@CurrentUser('userId') userId: string) {
    return this.users.deleteAccount(userId);
  }

  @Get(':username')
  publicProfile(@Param('username') username: string) {
    return this.users.getPublicProfile(username);
  }

  @Get(':username/history')
  history(@Param('username') username: string) {
    return this.users.getHistory(username);
  }
}
