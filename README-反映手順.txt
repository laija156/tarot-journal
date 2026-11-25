タロット手帳 追加ファイル

対象リポジトリ: laija156/tarot-journal
追加ファイル: notebook-addon.js

この追加機能は既存の TarotJournalDB / readings を変更せず、
TarotJournalNotebookDB という独立した IndexedDB に保存します。
デッキごとのキーは rws:カードID / marseille:カードID です。

GitHubへ反映する前に行う作業:
1. notebook-addon.js をリポジトリのルートにアップロード。
2. index.html の末尾にある enhancements.js の script タグの直後へ、次の1行を追加:
   <script src="notebook-addon.js"></script>
3. sw.js の CACHE 名を tarot-journal-v9 に変更。
4. sw.js の ASSETS 配列へ './notebook-addon.js' を追加。
5. sw.js の NETWORK_FIRST 配列へ './notebook-addon.js' を追加。

バックアップ:
- 既存の records を保持したまま notebook 配列もJSONへ書き出します。
- 古いバックアップ（notebook配列がないversion 2以前）も復元できます。
- 手帳データを含むバックアップの復元時は、既存記録と手帳データの両方を取り込みます。

注意:
- このZIPは追加機能ファイルと反映手順をまとめたものです。index.html / sw.js は未改変です。
- GitHub Pagesへの反映・実機動作確認はまだ行っていません。
- 反映前に現在のJSONバックアップを保存してください。
