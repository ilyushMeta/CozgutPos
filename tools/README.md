# Baza gurluşyny göçürmek (XAMPP / MySQL / MariaDB)

`dukan`, `gozegcilik` we `girs` bazalaryny bir `.sql` faýla jemläp, başga
kompýuterde gurnamak üçin.

## 1. Çykarmak (köne kompýuterde)

1. XAMPP Control Panel-da **MySQL** işläp dursun.
2. `dump-schema.bat` faýla iki gezek basyň.
3. Şol papkada `cozgut-schema.sql` peýda bolar.

MySQL-de parol goýan bolsaňyz, `.bat` faýly Notepad bilen açyp `DB_PASS`
setirine ýazyň. XAMPP başga diskde bolsa `MYSQL_BIN` setirini düzediň.

**Sazlaýjylar** (`dump-schema.bat` içinde):

| Sazlaýjy | Manysy |
|---|---|
| `WITH_DATA=0` | Diňe gurluş — tablisalar boş geçýär (deslapky) |
| `WITH_DATA=1` | Gurluş + içindäki ähli maglumat |
| `DROP_EXISTING=0` | Täze kompýuterde şol atly baza bar bolsa degmeýär (deslapky) |
| `DROP_EXISTING=1` | Şol atly bazany **pozup** täzeden döredýär |

## 2. Gurnamak (täze kompýuterde)

1. XAMPP gurnalan we MySQL işläp duran bolsun.
2. `cozgut-schema.sql` bilen `restore-schema.bat` bir papkada dursun.
3. `restore-schema.bat` faýla iki gezek basyň.

Faýlyň özünde `CREATE DATABASE` setirleri bar, şonuň üçin bazalary öňünden el
bilen döretmek gerek däl.

## Skriptsiz, el bilen

CMD-de (PowerShell däl — PowerShell `>` bilen faýly ýalňyş kodlamada ýazýar,
şonuň üçin `--result-file` ulanylýar):

```cmd
"C:\xampp\mysql\bin\mysqldump.exe" -u root ^
  --databases dukan gozegcilik girs ^
  --no-data --routines --triggers --events ^
  --default-character-set=utf8mb4 ^
  --result-file=C:\cozgut-schema.sql
```

Gurnamak:

```cmd
"C:\xampp\mysql\bin\mysql.exe" -u root < C:\cozgut-schema.sql
```

## phpMyAdmin arkaly (skript işlemese)

1. Çep sütünde bazany saýlaň → ýokarda **Export**.
2. **Custom** → Format: **SQL**.
3. Databases sanawyndan `dukan`, `gozegcilik`, `girs` saýlaň.
4. *Output* bölüminde **Save output to a file**.
5. *Format-specific options* → **Structure only**.
6. *Object creation options* → **Add CREATE DATABASE / USE statement** belläň.
7. **Export**.

## Bellikler

- `--routines --triggers --events` — saklanýan proseduralar, trigger-ler we
  event-ler hem faýla düşýär. Diňe `CREATE TABLE` gerek bolsa aýryp bolar.
- Baza atlarynda registr (kiçi/uly harp) Linux-da tapawutly, Windows-da däl.
  Windows-dan Linux serwerine geçirseňiz, atlar birmeňzeş ýazylandygyny barlaň.
- Çykan `.sql` faýl git-e goşulmaýar (`.gitignore`-da) — `WITH_DATA=1` bilen
  alnan bolsa, onuň içinde hakyky söwda maglumatlary bolýar.
