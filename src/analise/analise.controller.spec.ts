import { Test, TestingModule } from '@nestjs/testing';
import { AnaliseController } from './analise.controller';

describe('AnaliseController', () => {
  let controller: AnaliseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnaliseController],
    }).compile();

    controller = module.get<AnaliseController>(AnaliseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});