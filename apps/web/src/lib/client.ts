import { Client } from "@langchain/langgraph-sdk";
import { getDeployments } from "./environment/deployments";
import { getBaseApiUrl } from "./api-url";

export function createClient(deploymentId: string, accessToken?: string) {
  const deployment = getDeployments().find((d) => d.id === deploymentId);
  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  if (!accessToken || process.env.NEXT_PUBLIC_USE_LANGSMITH_AUTH === "true") {
    const baseApiUrl = getBaseApiUrl();
    const client = new Client({
      apiUrl: `${baseApiUrl}/api/langgraph/proxy/${deploymentId}`,
      defaultHeaders: {
        "x-auth-scheme": "langsmith",
      },
    });
    return client;
  }

  const client = new Client({
    apiUrl: deployment.deploymentUrl,
    defaultHeaders: {
      Authorization: `Bearer ${accessToken}`,
      "x-supabase-access-token": accessToken,
    },
  });
  return client;
}
