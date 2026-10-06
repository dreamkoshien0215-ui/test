"""index.html から claude.ai 公開ページ用の本体部分を切り出す。

使い方: python3 tools/build_artifact.py <出力パス>
公開ページは <!doctype>/<head>/<body> を自動で付けるため、マーカー間だけを書き出す。
"""
import sys
from pathlib import Path

src = (Path(__file__).resolve().parent.parent / "index.html").read_text(encoding="utf-8")
start = src.index("\n", src.index("<!-- @@ARTIFACT_START@@")) + 1
end = src.index("<!-- @@ARTIFACT_END@@")
Path(sys.argv[1]).write_text(src[start:end], encoding="utf-8")
print(f"wrote {sys.argv[1]} ({end - start} bytes)")
