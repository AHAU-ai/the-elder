
import pathlib, os
os.makedirs("lib/i18n", exist_ok=True)

pathlib.Path("lib/i18n/translations.ts").write_text(''
)
print("done")
