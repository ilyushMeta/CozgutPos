import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import {
  createUserSchema,
  updateUserSchema,
  Role,
  type CreateUserInput,
  type UpdateUserInput,
  type AuthUser,
} from '@cozgut/shared';
import type { User } from '@prisma/client';
import { UsersService } from './users.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

/** Never expose passwordHash to the client. */
function toSafeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async findAll() {
    const users = await this.users.findAll();
    return users.map(toSafeUser);
  }

  @Post()
  async create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return toSafeUser(await this.users.create(body));
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() actingUser: AuthUser,
  ) {
    return toSafeUser(await this.users.update(id, body, actingUser.id));
  }
}
