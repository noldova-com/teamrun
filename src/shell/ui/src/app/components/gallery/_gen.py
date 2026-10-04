import io
lic='''/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

'''
html_lic='''<!--
@license
Copyright (c) Noldova.

This source code is licensed under the license found in the
LICENSE file in the root directory of this source tree.
-->

'''
def w(name, body, h=False):
    io.open(name,'w',encoding='utf-8',newline='').write((html_lic if h else lic)+body)
