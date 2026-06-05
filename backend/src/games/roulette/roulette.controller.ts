import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RouletteService } from './roulette.service';

@Public()
@Controller('games/roulette')
export class RouletteController {
  constructor(private readonly roulette: RouletteService) {}

  @Get('history')
  history() {
    return this.roulette.history(20);
  }
}
