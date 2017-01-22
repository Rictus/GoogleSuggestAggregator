#!/bin/bash

sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get dist-upgrade -y
sudo apt-get install npm nodejs tmux n -y

npm i

if [ ! -d "./queried" ];
then
    mkdir queried
fi