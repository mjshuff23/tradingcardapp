import { parseCsv } from "../src/common/csv.util";

describe("csv.util", () => {
  it("parses quoted values with commas", () => {
    const rows = parseCsv('name,set\n"LeBron James, Rookie","Topps Chrome"');
    expect(rows).toEqual([
      {
        name: "LeBron James, Rookie",
        set: "Topps Chrome",
      },
    ]);
  });
});
