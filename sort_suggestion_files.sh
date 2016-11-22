#!/bin/bash

DIRECTORY_SRC="queried"
DIRECTORY_OUTPUT="suggestions"

if [ ! -d $DIRECTORY_SRC ]; then
    echo "The directory '$DIRECTORY_SRC' doesn't exist"
    exit
fi

NB_FILES=`ls -1 $DIRECTORY_SRC|wc -l`
FILES=`ls -1 $DIRECTORY_SRC`

if [ $NB_FILES -eq 0 ];
then
    echo "The directory '$DIRECTORY_SRC' is empty."
    exit
else
    echo "$NB_FILES files detected in directory '$DIRECTORY_SRC'."
fi

if [ ! -d $DIRECTORY_OUTPUT ]; then
    mkdir $DIRECTORY_OUTPUT
fi

for f in $DIRECTORY_SRC/*
do
    o=`basename $f`
    LC_COLLATE=C sort -h $f > ${DIRECTORY_OUTPUT}/${o}
    echo "File $f has been sorted to ${DIRECTORY_OUTPUT}/${o}."
done
