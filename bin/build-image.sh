#!/usr/bin/env bash
# set -x

SCRIPT_ROOT=$(dirname $0 | xargs -I {} realpath {})

if [[ -z "$APIKEY" ]]; then
  echo "APIKEY is required"
  exit 1
fi

if [[ -z "$RESOURCE_GROUP" ]]; then
  echo "RESOURCE_GROUP is required"
  exit 1
fi

#if [[ -z "$CLUSTER_NAME" ]]; then
#  echo "CLUSTER_NAME is required"
#  exit 1
#fi

if [[ -z "$1" ]]; then
  echo "Image name required as first arg"
  exit 1
else
  IMAGE_NAME="$1"
fi

if [[ -z "$2" ]]; then
  echo "Image version required as second arg"
  exit 1
else
  IMAGE_VER="$2"
fi

if [[ ! -z "$3" ]]; then
  BUILD_NUMBER="$3"
fi

ibmcloud login -a https://cloud.ibm.com --apikey ${APIKEY} -g ${RESOURCE_GROUP} -r ${REGION}
#ibmcloud ks cluster-config --cluster ${CLUSTER_NAME} --export > ./.kubeconfig
#
#source ./.kubeconfig

echo "Checking registry namespace: ${REGISTRY_NAMESPACE}"
NS=$( ibmcloud cr namespaces | grep ${REGISTRY_NAMESPACE} ||: )
if [[ -z "${NS}" ]]; then
    echo -e "Registry namespace ${REGISTRY_NAMESPACE} not found, creating it."
    ibmcloud cr namespace-add ${REGISTRY_NAMESPACE}
    ${SCRIPT_ROOT}/setup-namespace-secrets.sh ${REGISTRY_NAMESPACE}
    echo -e "Registry namespace ${REGISTRY_NAMESPACE} created."
else
    echo -e "Registry namespace ${REGISTRY_NAMESPACE} found."
fi

echo -e "Existing images in registry"
ibmcloud cr images --restrict "${REGISTRY_NAMESPACE}/${IMAGE_NAME}"

echo "=========================================================="
echo -e "BUILDING CONTAINER IMAGE: ${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_VER}"
set -x
ibmcloud cr build -t ${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_VER} .
if [[ -z "$BUILD_NUMBER" ]]; then
    echo -e "BUILDING CONTAINER IMAGE: ${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_VER}-${BUILD_NUMBER}"
    ibmcloud cr build -t ${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_VER}-${BUILD_NUMBER} .
fi

set +x
ibmcloud cr image-inspect ${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_VER}
if [[ -z "$BUILD_NUMBER" ]]; then
    ibmcloud cr image-inspect ${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_VER}-${BUILD_NUMBER}
fi

ibmcloud cr images --restrict ${REGISTRY_NAMESPACE}/${IMAGE_NAME}
