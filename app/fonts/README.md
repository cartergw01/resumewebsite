`archivo-latin-variable.woff2` is Archivo (Copyright 2020 The Archivo Project
Authors, https://github.com/Omnibus-Type/Archivo), licensed under the SIL Open
Font License 1.1 (https://openfontlicense.org).

It is Google Fonts' latin subset with its variation axes narrowed to what the
site sets: width 100–125% (body text and the expanded headings) and weight
400–900. That cut it from 88 KB to 61 KB. Rebuild with fontTools:

```bash
python -m fontTools.varLib.instancer archivo.woff2 wdth=100:125 wght=400:900 -o out.ttf
python -c "from fontTools.ttLib import TTFont; f=TTFont('out.ttf'); f.flavor='woff2'; f.save('archivo-latin-variable.woff2')"
```
