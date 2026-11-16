# IPL data pipeline

Turns Cricsheet's ball-by-ball IPL data into the small JSON files the website reads.

1. Download https://cricsheet.org/downloads/ipl_json.zip into this folder (it is not committed to git).
2. From the repo root, run:

   ```
   python pipeline/build_ipl.py
   ```

3. Commit the updated files in `web/data/ipl/`.

Only the Python standard library is needed. Re-run it during the IPL season to pick up new matches.

Data: [Cricsheet](https://cricsheet.org), licensed under the Open Data Commons Attribution License.
