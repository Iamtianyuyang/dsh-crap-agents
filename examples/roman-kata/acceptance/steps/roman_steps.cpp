// Step definitions for features/roman.feature. Drive the application boundary (roman::cli::run),
// not the internals: acceptance tests describe behaviour, unit tests pin the details.
#include <sstream>
#include <string>
#include <vector>

#include "app/cli.h"
#include "gauntlet_acceptance.hpp"

namespace {
struct Run {
  std::vector<std::string> args;
  std::string out, err;
  int code = -1;
};

std::vector<std::string> split_words(const std::string& s) {
  std::istringstream in(s);
  std::vector<std::string> words;
  for (std::string w; in >> w;) words.push_back(w);
  return words;
}

std::string trim_trailing_newline(std::string s) {
  while (!s.empty() && (s.back() == '\n' || s.back() == '\r')) s.pop_back();
  return s;
}
}  // namespace

GT_STEP("我输入 {string}") { ctx.get<Run>("run").args = split_words(args.s(0)); }

GT_STEP("我什么都不输入") { ctx.get<Run>("run").args.clear(); }

GT_STEP("我执行转换") {
  auto& r = ctx.get<Run>("run");
  std::ostringstream out, err;
  r.code = roman::cli::run(r.args, out, err);
  r.out = out.str();
  r.err = err.str();
}

GT_STEP("输出应为 {string}") { GT_EXPECT_EQ(trim_trailing_newline(ctx.get<Run>("run").out), args.s(0)); }

GT_STEP("输出应为:") { GT_EXPECT_EQ(trim_trailing_newline(ctx.get<Run>("run").out), args.doc_string); }

GT_STEP("退出码应为 {int}") { GT_EXPECT_EQ(ctx.get<Run>("run").code, static_cast<int>(args.i(0))); }

GT_STEP("错误信息应包含 {string}") {
  const auto& err = ctx.get<Run>("run").err;
  if (err.find(args.s(0)) == std::string::npos) GT_FAIL("stderr was: " + err);
}
