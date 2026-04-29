import { Test, TestingModule } from '@nestjs/testing';
import { AnaliseService } from './analise.service';

describe('AnaliseService', () => {
  let service: AnaliseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnaliseService],
    }).compile();

    service = module.get<AnaliseService>(AnaliseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
