#!/bin/sh

# kind
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
	- containerPort: 31112
		hostPort: 8080
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

# OpenFaaS
arkade install openfaas
kubectl rollout status -n openfaas deploy

# faas-cli
arkade get faas-cli
sudo mv ~/.arkade/bin/faas-cli /usr/local/bin/

PASSWORD=$(kubectl get secret -n openfaas basic-auth -o jsonpath="{.data.basic-auth-password}" | base64 --decode; echo)
echo -n "$PASSWORD" | faas-cli login --username admin --password-stdin

npm install

npm run deploy

echo "> Listening on http://admin:$PASSWORD@localhost:8080/"