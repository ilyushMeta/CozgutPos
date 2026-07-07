import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Realtime gateway (SPEC §3). Phase 1 provides the socket server; later phases
 * emit stock/sale/cash/debt events to all LAN clients.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  afterInit(): void {
    // Reserved for auth middleware / room setup in later phases.
  }

  /** Broadcast a named event to all connected clients. */
  emit(event: string, payload: unknown): void {
    this.server?.emit(event, payload);
  }
}
