import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { FormSubmissionDto } from './form-submissions.types';
import { FormSubmissionsService } from './form-submissions.service';

/** Владелец-only чтение/удаление — создание заявок не проходит через этот
 * контроллер вообще (см. `PublicSitesController.createFormSubmission`,
 * анонимный путь). Нет `POST`/`PATCH` здесь намеренно: заявку нельзя
 * отредактировать, только прочитать или удалить (например, спам). */
@Controller('businesses/:businessId/form-submissions')
@UseGuards(SessionAuthGuard)
export class FormSubmissionsController {
  constructor(private readonly formSubmissionsService: FormSubmissionsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<FormSubmissionDto[]> {
    return this.formSubmissionsService.list(businessId, currentUser.id);
  }

  @Delete(':submissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('submissionId') submissionId: string,
  ): Promise<void> {
    return this.formSubmissionsService.remove(businessId, submissionId, currentUser.id);
  }
}
