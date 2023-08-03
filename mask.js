const file = await import(process.argv[2], { assert: { type: "json" } })

function getValues(obj) {
  const values = []
  if (typeof obj !== "object") {
    return values
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object") {
      values.push(...getValues(obj[key]))
    } else if (typeof obj[key] !== "boolean") {
      values.push(obj[key])
    }
  }

  return values
}

const values = getValues(file)

for (const value of values) {
  console.log(`::add-mask::${value}`)
}
