#!/bin/bash


sudo apt-get install npm nodejs

npm i

if [ ! -d "queried" ];
then
    mkdir queried
fi

if [ ! -d "generations" ];
then
    mkdir generations
fi