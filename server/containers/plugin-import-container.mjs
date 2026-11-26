import {Container} from '@cloudflare/containers';

// This container is a CPU/memory-bound conversation normalizer only.
// OAuth, LOC writes and all live credentials remain in the Worker.
export class PluginImportContainer extends Container {
 defaultPort=8080;
 sleepAfter='2m';
 enableInternet=false;
}
