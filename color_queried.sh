#!/bin/bash

TEST_LINE="llc > fregre,gr---grth,fsd"

KEYWORD=`echo $TEST_LINE | cut -d" " -f1`
CHEVRON=`echo $TEST_LINE | cut -d" " -f2`
SUGGESTIONS=`echo $TEST_LINE | cut -d" " -f3`


echo -en "$(tput bold)$(tput setaf 6)$KEYWORD$(tput sgr0)""$(tput setaf 3) $CHEVRON $(tput sgr0)"


OLD_IFS=$IFS
IFS=',' read -ra SUGGESTIONS <<< "$SUGGESTIONS"
for SUGGESTION in "${SUGGESTIONS[@]}"; do
    SUGGESTION_GREP=`echo $SUGGESTION|grep --color=always -e "[^a-zA-Z0-9]"`

    if [ ${#SUGGESTION_GREP} -eq 0 ];
    then
        SUGGESTION_GREP=$SUGGESTION
    fi

    echo -en "$(tput setaf 7)$SUGGESTION_GREP$(tput sgr 0)$(tput setaf 2),$(tput sgr 0) "
done
IFS=$OLD_IFS

tput sgr0