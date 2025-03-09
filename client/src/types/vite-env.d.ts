/// <reference types="vite/client" />

import { ServerOptions } from 'vite';

declare module 'vite' {
  interface ServerOptions {
    allowedHosts?: boolean | true | string[];
  }
}
