'use strict';
// Optional diagnostic script. Never embed MongoDB Atlas credentials in source.
// Configure MongoDbAtlas as an environment secret for local execution.
const { MongoClient } = require('mongodb');
async function run() {
    const uri = process.env.MongoDbAtlas;
    if (!uri) throw new Error('Configure MongoDbAtlas no ambiente.');
    const client = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        const docs = await client.db('IBLUEIT').collection('plataformoverviews')
            .aggregate([{ $project: { _id: 1, pacientId: 1 } }, { $limit: 10 }]).toArray();
        console.log('Consulta diagnóstica concluída; quantidade de registros:', docs.length);
    } finally {
        await client.close();
    }
}
if (require.main === module) {
    run().catch(err => {
        console.error('Consulta diagnóstica falhou:', err && err.name);
        process.exitCode = 1;
    });
}
