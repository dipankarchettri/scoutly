import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String },
    tier: {
        type: String,
        enum: ['free', 'paid'],
        default: 'free'
    },
    credits: {
        total: { type: Number, default: 2 },
        used: { type: Number, default: 0 },
        lastResetDate: { type: Date, default: Date.now }
    },
    apiKey: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Reset credits if needed (middleware)
UserSchema.pre('save', function (next) {
    // Logic for auto-resetting credits could go here
    next();
});

export const User = mongoose.model('User', UserSchema);
