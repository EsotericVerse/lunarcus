// Cloudflare Worker entry: keep the Container class export separate from
// the Node-testable LAS application module.
export {PluginImportContainer} from './containers/plugin-import-container.mjs';
export {PluginImportWorkflow} from './import/workflow.mjs';
import app from './index.mjs';
import {consumePluginImportQueue} from './import/queue-consumer.mjs';

export default {
 async fetch(request,env,execution){return app.fetch(request,env,execution);},
 async queue(batch,env){return consumePluginImportQueue(batch,env);}
};
