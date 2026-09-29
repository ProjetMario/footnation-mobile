const ts = require("typescript");
function booleanCondition(node, checker) {
  if (ts.isParenthesizedExpression(node))
    return booleanCondition(node.expression, checker);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.ExclamationToken
  )
    return true;
  if (
    [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(node.kind)
  )
    return true;
  if (ts.isCallExpression(node) && node.expression.getText() === "Boolean")
    return true;
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(
      node.operatorToken.kind,
    ) &&
    booleanCondition(node.left, checker) &&
    booleanCondition(node.right, checker)
  )
    return true;
  if (checker) {
    const type = checker.getTypeAtLocation(node);
    const members = type.isUnion() ? type.types : [type];
    if (
      members.every(
        (member) =>
          member.flags &
          (ts.TypeFlags.BooleanLike |
            ts.TypeFlags.Null |
            ts.TypeFlags.Undefined),
      )
    )
      return true;
  }
  return (
    ts.isBinaryExpression(node) &&
    [
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.GreaterThanToken,
      ts.SyntaxKind.GreaterThanEqualsToken,
      ts.SyntaxKind.LessThanToken,
      ts.SyntaxKind.LessThanEqualsToken,
      ts.SyntaxKind.InKeyword,
      ts.SyntaxKind.InstanceOfKeyword,
    ].includes(node.operatorToken.kind)
  );
}
function unsafeCondition(node, ast, checker) {
  if (
    !ts.isJsxExpression(node) ||
    !node.expression ||
    !(ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
  )
    return null;
  let parent = node.parent;
  while (parent && ts.isJsxFragment(parent)) parent = parent.parent;
  if (
    parent &&
    ts.isJsxElement(parent) &&
    ["Text", "Animated.Text"].includes(
      parent.openingElement.tagName.getText(ast),
    )
  )
    return null;
  let expression = node.expression;
  while (ts.isParenthesizedExpression(expression))
    expression = expression.expression;
  return ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
    !booleanCondition(expression.left, checker)
    ? expression.left
    : null;
}
module.exports = { unsafeCondition };
