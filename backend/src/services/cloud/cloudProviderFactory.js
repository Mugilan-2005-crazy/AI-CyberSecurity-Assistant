import AWSConnector from './awsConnector.js';
import AzureConnector from './azureConnector.js';
import GCPConnector from './gcpConnector.js';
import CloudProvider from '../../models/CloudProvider.js';
import logger from '../../utils/logger.js';

const PROVIDER_MAP = {
  aws: AWSConnector,
  azure: AzureConnector,
  gcp: GCPConnector,
};

export const createConnector = (provider, credentials, accountId, accountName, region) => {
  const ConnectorClass = PROVIDER_MAP[provider];
  if (!ConnectorClass) {
    throw new Error(`Unsupported cloud provider: ${provider}`);
  }

  return new ConnectorClass({
    provider,
    accountId,
    accountName,
    region,
    credentials,
    metadata: {},
  });
};

export const createConnectorFromDB = async (providerId) => {
  const provider = await CloudProvider.findById(providerId);
  if (!provider) {
    throw new Error(`Cloud provider not found: ${providerId}`);
  }

  if (!provider.isEnabled) {
    throw new Error(`Cloud provider ${provider.name} is disabled`);
  }

  const credentials = {
    accessKeyId: provider.credentials?.accessKeyId,
    secretAccessKey: provider.credentials?.secretAccessKey,
    sessionToken: provider.credentials?.sessionToken,
    tenantId: provider.credentials?.tenantId,
    clientId: provider.credentials?.clientId,
    clientSecret: provider.credentials?.clientSecret,
    subscriptionId: provider.credentials?.subscriptionId,
    serviceAccountKey: provider.credentials?.serviceAccountKey,
    projectId: provider.accountId,
  };

  const connector = createConnector(
    provider.provider,
    credentials,
    provider.accountId,
    provider.accountName,
    provider.region
  );

  return connector;
};

export const getAvailableProviders = () => Object.keys(PROVIDER_MAP);

export const getAllConnectors = async () => {
  const providers = await CloudProvider.find({ isEnabled: true, status: { $ne: 'error' } }).lean();
  const connectors = [];

  for (const provider of providers) {
    try {
      const credentials = {
        accessKeyId: provider.credentials?.accessKeyId,
        secretAccessKey: provider.credentials?.secretAccessKey,
        sessionToken: provider.credentials?.sessionToken,
        tenantId: provider.credentials?.tenantId,
        clientId: provider.credentials?.clientId,
        clientSecret: provider.credentials?.clientSecret,
        subscriptionId: provider.credentials?.subscriptionId,
        serviceAccountKey: provider.credentials?.serviceAccountKey,
        projectId: provider.accountId,
      };

      const connector = createConnector(
        provider.provider,
        credentials,
        provider.accountId,
        provider.accountName,
        provider.region
      );

      connectors.push({ provider, connector });
    } catch (err) {
      logger.warn('[cloudProviderFactory] Failed to create connector', { provider: provider.name, error: err.message });
    }
  }

  return connectors;
};

export default { createConnector, createConnectorFromDB, getAvailableProviders, getAllConnectors };
