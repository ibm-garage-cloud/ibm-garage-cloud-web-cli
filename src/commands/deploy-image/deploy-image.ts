import * as path from 'path';
import {execFile} from 'child_process';

import {DeployOptions} from './deploy-options.model';
import {DEPLOY_OPTION_ENV_PROPERTIES, extractEnvironmentProperties} from '../../util/env-support';

export async function deployImage(options: DeployOptions): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      path.join(__dirname, '../../../bin/deploy-image.sh'),
      [options.namespace, options.imageName, options.imageVersion],
      {
        env: extractEnvironmentProperties(DEPLOY_OPTION_ENV_PROPERTIES, options),
        cwd: process.cwd()
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        }

        resolve({stdout, stderr});
      }
    );

    child.stdout.on('data', function(data) {
      console.log(data.toString());
    });
    child.stderr.on('data', function(data) {
      console.error(data.toString());
    });
    process.stdin.pipe(child.stdin);
  });
}