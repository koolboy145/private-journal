import { SessionData, Store } from 'express-session';
import { sessionQueries } from './database.js';

export class SQLiteStore extends Store {
  constructor() {
    super();
  }

  get(sid: string, callback: (err?: any, session?: SessionData | null) => void): void {
    try {
      const now = Date.now();
      const result = sessionQueries.get.get(sid, now) as { sess: string } | undefined;
      
      if (result) {
        const session = JSON.parse(result.sess);
        callback(null, session);
      } else {
        callback(null, null);
      }
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    try {
      const maxAge = session.cookie.maxAge || 86400000; // Default 1 day
      const expire = Date.now() + maxAge;
      const sess = JSON.stringify(session);
      
      sessionQueries.set.run(sid, sess, expire);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      sessionQueries.destroy.run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  clear(callback?: (err?: any) => void): void {
    try {
      sessionQueries.clear.run();
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  length(callback: (err: any, length?: number) => void): void {
    try {
      const now = Date.now();
      const result = sessionQueries.length.get(now) as { count: number };
      callback(null, result.count);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    try {
      const maxAge = session.cookie.maxAge || 86400000;
      const expire = Date.now() + maxAge;
      
      sessionQueries.touch.run(expire, sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
}


