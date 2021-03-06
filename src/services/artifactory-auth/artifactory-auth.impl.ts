import {Inject} from 'typescript-ioc';
import {KubeConfigMap, KubeSecret, Secret} from '@ibmgaragecloud/cloud-native-toolkit-cli/dist/api/kubectl';

import {ArtifactoryAuth, ArtifactoryAuthOptions} from './artifactory-auth.api';
import {ArtifactorySetupError, ArtifactorySetupResult, SetupArtifactory} from '../artifactory-setup';
import {LoggingApi} from '../../logging';
import {configureKubernetesBackend} from '../../util/configure-kubernetes-backend';

interface ArtifactorySecretData {
  ARTIFACTORY_URL?: string;
  ARTIFACTORY_USER: string;
  ARTIFACTORY_PASSWORD: string;
  ARTIFACTORY_ENCRYPT?: string;
}

export class ArtifactoryAuthImpl implements ArtifactoryAuth {
  @Inject
  kubeConfigMap: KubeConfigMap;
  @Inject
  kubeSecret: KubeSecret;
  @Inject
  artifactory: SetupArtifactory;
  @Inject
  logger: LoggingApi;

  async setupArtifactoryAuth({namespace = 'tools', inCluster = false}: ArtifactoryAuthOptions): Promise<void> {

    configureKubernetesBackend(inCluster);

    const config: {url: string, publicUrl: string, username: string, password: string} = await this.getArtifactoryUrlAndCredentials(namespace, inCluster);

    this.logger.log('Retrieved Artifactory config: ', Object.assign({}, config, {password: !!config.password ? 'xxxx' : ''}));

    const credentials: ArtifactorySetupResult = await this.artifactory.setupArtifactory(config).catch(err => {
      this.logger.debug('Error setting up Artifactory: ', err);

      if (err instanceof ArtifactorySetupError) {
        return err.result;
      } else {
        return {};
      }
    });

    if (credentials.newPassword) {
      this.logger.log('Updating Artifactory credentials');

      await this.updateArtifactoryCredentials(namespace, credentials);
    } else {
      this.logger.log('No credentials to update', credentials);
    }
  }

  async getArtifactoryUrlAndCredentials(namespace: string, inCluster: boolean): Promise<{url: string, publicUrl: string, username: string, password: string}> {
    const result: {url: string, username: string, password: string} = await this.kubeSecret
      .getData<ArtifactorySecretData>('artifactory-access', namespace)
      .then(d => ({url: d.ARTIFACTORY_URL, username: d.ARTIFACTORY_USER, password: d.ARTIFACTORY_PASSWORD}));

    const publicUrl = await this.kubeConfigMap
      .getData<{ARTIFACTORY_URL: string}>('artifactory-config', namespace)
      .then(d => d.ARTIFACTORY_URL);

    return Object.assign({}, result, {url: publicUrl, publicUrl});
  }

  async updateArtifactoryCredentials(namespace: string, credentials: ArtifactorySetupResult) {
    const secret: Secret = await this.kubeSecret.get('artifactory-access', namespace);

    const updatedSecret = Object.assign(
      {},
      secret,
      {
        data: this.updateSecretData(secret.data, credentials)
      },
    );

    await this.kubeSecret.update('artifactory-access', {body: updatedSecret}, namespace);
  }

  updateSecretData(data: ArtifactorySecretData, credentials: ArtifactorySetupResult): ArtifactorySecretData {
    return Object.assign(
      {},
      data,
      {
        ARTIFACTORY_PASSWORD: Buffer.from(credentials.newPassword).toString('base64'),
        ARTIFACTORY_ENCRYPT: Buffer.from(credentials.encryptedPassword).toString('base64'),
      },
    );
  }
}