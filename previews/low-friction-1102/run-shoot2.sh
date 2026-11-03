#!/bin/bash
cd /workspace/xcpets/previews/low-friction-1102
echo "start $(date +%T) avail=$(free -m|awk '/Mem/{print $7}')"
timeout 900 node shoot2.js /tmp/lfm/main-tree before $NAMES; echo "before exit $? avail=$(free -m|awk '/Mem/{print $7}')"
timeout 900 node shoot2.js /workspace/wt-low-friction-1102 after $NAMES; echo "after exit $? $(date +%T)"
