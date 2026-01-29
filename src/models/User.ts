import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String },
    tier: {
        type: String,
        enum: ['free', 'paid'],
        default: 'free'
    },
    credits: {
        type: Number,
        default: 50
    },
    savedStartups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Startup'
    }],
    lastDailyReset: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Reset credits if needed (middleware)
// Reset credits if needed (middleware)
// UserSchema.pre('save', function (next) {
//     next();
// });

export const User = mongoose.model('User', UserSchema);
