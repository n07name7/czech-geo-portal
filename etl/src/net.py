"""Force IPv4 for all outbound HTTP.

Several Czech government hosts (e.g. lkod-ftp.msmt.gov.cz) publish AAAA
records, but GitHub Actions runners have no IPv6 route — requests then
fail with "Network is unreachable". Importing this module makes urllib3
(and thus requests) resolve to IPv4 only.
"""
import socket

import urllib3.util.connection as urllib3_cn


def _allowed_gai_family() -> int:
    return socket.AF_INET


urllib3_cn.allowed_gai_family = _allowed_gai_family
