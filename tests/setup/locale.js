// Most tests check Portuguese text; pinning the page language (as YouTube does with <html lang>)
// keeps those tests stable. Tests for other languages change the attribute and restore it at the
// end.
document.documentElement.lang = 'pt-BR';
