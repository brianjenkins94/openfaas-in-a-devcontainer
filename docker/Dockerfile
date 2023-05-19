# syntax=docker/dockerfile:1.4

FROM mcr.microsoft.com/devcontainers/base:ubuntu

ENV container=docker

ENV OPENFAAS_URL=http://localhost:8080
ENV OPENFAAS_PREFIX=localhost:5000

RUN sudo apt-get update > /dev/null \
	# Node.js
	&& wget -qO- https://deb.nodesource.com/setup_lts.x | sudo sh \
	# Common
	&& sudo apt-get install -y dos2unix file nodejs \
	# Arkade
	&& curl -fsSL https://get.arkade.dev | sudo sh
	# kubectl
	#&& arkade get kubectl \
	#&& sudo mv /home/vscode/.arkade/bin/kubectl /usr/local/bin/
	# KinD
	#&& arkade get kind \
	#&& sudo mv /home/vscode/.arkade/bin/kind /usr/local/bin/

COPY --chmod=755 ./entrypoint.sh /entrypoint.sh

RUN dos2unix /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
