import { EventEmitter } from 'events';

export interface AnalysisCompletedEvent {
  targetCompanyId: number;
  eventId: number;
  status: 'completed' | 'failed';
  analysisType: 'stage1' | 'detailed' | 'document';
  timestamp: Date;
  data?: any;
}

export interface FileUploadedEvent {
  documentId: number;
  targetCompanyId: number;
  userCompanyId: number;
  fileName: string;
  mimeType: string;
  category?: string;
  uploadedBy: number;
  timestamp: Date;
}

export interface StageUpdatedEvent {
  targetCompanyId: number;
  previousStage: string;
  newStage: string;
  updatedBy: number;
  timestamp: Date;
}

export interface DocumentUpdateEvent {
  type: 'analysis_started' | 'analysis_completed' | 'document_uploaded' | 'stage1_completed' | 'detailed_analysis_completed';
  targetCompanyId: number;
  documentId?: number;
  eventId?: number;
  status?: string;
  data?: any;
  timestamp: Date;
}

type EventMap = {
  'analysis:completed': AnalysisCompletedEvent;
  'file:uploaded': FileUploadedEvent;
  'stage:updated': StageUpdatedEvent;
  'document:update': DocumentUpdateEvent;
};

type EventName = keyof EventMap;

class ServerEventBus {
  private emitter: EventEmitter;
  private static instance: ServerEventBus;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  static getInstance(): ServerEventBus {
    if (!ServerEventBus.instance) {
      ServerEventBus.instance = new ServerEventBus();
    }
    return ServerEventBus.instance;
  }

  emit<K extends EventName>(event: K, payload: EventMap[K]): boolean {
    return this.emitter.emit(event, payload);
  }

  on<K extends EventName>(event: K, listener: (payload: EventMap[K]) => void): this {
    this.emitter.on(event, listener);
    return this;
  }

  once<K extends EventName>(event: K, listener: (payload: EventMap[K]) => void): this {
    this.emitter.once(event, listener);
    return this;
  }

  off<K extends EventName>(event: K, listener: (payload: EventMap[K]) => void): this {
    this.emitter.off(event, listener);
    return this;
  }

  removeAllListeners(event?: EventName): this {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
    return this;
  }

  listenerCount(event: EventName): number {
    return this.emitter.listenerCount(event);
  }
}

export const eventBus = ServerEventBus.getInstance();
export { ServerEventBus };
