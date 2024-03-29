#!/bin/sh

# KinD
arkade get kind
sudo mv ~/.arkade/bin/kind /usr/local/bin/

kind delete cluster

docker container rm --force "$(docker ps --filter name="kind-" --all --quiet)"

docker run -d --restart=always -p 127.0.0.1:5000:5000 --name "kind-registry" registry:2

sed "s/\t/  /g" <<EOF | kind create cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
containerdConfigPatches:
- |-
	[plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:5000"]
		endpoint = ["http://kind-registry:5000"]
nodes:
- role: control-plane
	extraPortMappings:
	# OpenFaaS
	- containerPort: 31112
		hostPort: 8080
	# Minio
	- containerPort: 30000
		hostPort: 9000
	# Prometheus
	- containerPort: 30090
		hostPort: 9090
	# Redis
	- containerPort: 30379
		hostPort: 6379
EOF

if [ "$(docker inspect -f='{{json .NetworkSettings.Networks.kind}}' "kind-registry")" = 'null' ]; then
	docker network connect "kind" "kind-registry"
fi

sed "s/\t/  /g" <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
	name: local-registry-hosting
	namespace: kube-public
data:
	localRegistryHosting.v1: |
		host: "localhost:5000"
		help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF

# OpenFaaS (:8080)
arkade install openfaas
kubectl rollout status --namespace openfaas deploy

# cron-connector
arkade install cron-connector

# Minio (:9000)
arkade install minio
arkade get mc
sudo mv ~/.arkade/bin/mc /usr/local/bin/
kubectl patch service minio --type="json" -p '[{"op":"replace","path":"/spec/type","value":"NodePort"},{"op":"replace","path":"/spec/ports/0/nodePort","value":30000}]'

# Prometheus (:9090)
kubectl patch service prometheus --namespace openfaas --type="json" -p '[{"op":"replace","path":"/spec/type","value":"NodePort"},{"op":"replace","path":"/spec/ports/0/nodePort","value":30090}]'

# Redis (:6379)
arkade install redis --namespace openfaas-fn --set usePassword=false --set master.persistence.enabled=false
kubectl patch service redis-master --namespace openfaas-fn --type="json" -p '[{"op":"replace","path":"/spec/type","value":"NodePort"},{"op":"replace","path":"/spec/ports/0/nodePort","value":30379}]'

# faas-cli
arkade get faas-cli
sudo mv ~/.arkade/bin/faas-cli /usr/local/bin/

PASSWORD=$(kubectl get secret --namespace openfaas basic-auth -o jsonpath="{.data.basic-auth-password}" | base64 --decode; echo)
echo -n "$PASSWORD" | faas-cli login --username admin --password-stdin

npm install

npm run deploy

echo "> Ready on http://admin:$PASSWORD@localhost:8080/"
